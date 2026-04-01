# Phase 174: Greenfield Compatibility Surface Cleanup - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<phase_intent>
## Phase Intent
- **Local Purpose:** Remove compatibility-only command, schema, and guidance drag so Phase 174 leaves one active greenfield support model instead of carrying retired upgrade-era surfaces.
- **Expected User Change:** Before: maintainers could still run into migration-only helpers, hidden legacy fallbacks, or stale worktree-era guidance that made the supported model feel split-brain. After: canonical planning/runtime paths stay strict, retired compatibility surfaces are removed unless a still-supported parser must explicitly reject a legacy key/shape, and docs/help/templates teach only the JJ/workspace-first model. Examples: `util:config-migrate`-style upgrade helpers disappear instead of lingering as routed dead surfaces; canonical `.planning/` artifacts still parse without rewrite-on-read normalization; published guidance no longer teaches `worktree`-era behavior.
- **Non-Goals:**
  - Preserve retired compatibility entrypoints just to give migration breadcrumbs for obsolete local setups.
  - Add new planning/runtime capabilities beyond cleanup of compatibility-era surfaces.
  - Finish every possible diagnostic-lane cleanup now; later phases may remove remaining inspect-only legacy diagnosis if it stops paying for itself.
</phase_intent>

<domain>
## Phase Boundary
Maintainers can remove compatibility-only product drag so the repo reflects one current greenfield support model without breaking canonical planning artifacts.
</domain>

<decisions>
## Implementation Decisions

### High-Impact Decisions
- Unsupported surface behavior - Locked. Retired compatibility-era surfaces should be removed by default, not preserved as user-facing stubs; only a still-supported parser that directly encounters a legacy key or shape should emit an explicit unsupported error. Reasoning: this keeps the product greenfield-first while preserving direct diagnostics where a supported path still needs to reject bad input.
- Canonical schema enforcement - Locked. Mutating, planning, and runtime paths should hard-fail on non-canonical planning/config shapes, while an intentionally narrow inspect/health-style diagnostic lane may report unsupported legacy shapes without normalizing them. Reasoning: Phase 174 should simplify active behavior now without silently reintroducing rewrite-on-read compatibility.

### Medium Decisions
- Stale guidance posture - Locked. Docs, help, and templates should be canonical-only and remove compatibility-era references rather than keeping a maintainer-facing migration note. Reasoning: published guidance should match the supported product exactly, especially after prior phases already established greenfield-only command and workspace posture.
- Discovery cleanup posture - Locked. Gut hidden/internal fallback mappings too when they exist only for historical compatibility; do not keep split-brain discovery behavior behind a canonical-only public surface. Reasoning: stress testing showed tolerance for hidden legacy paths would keep the product mentally and operationally inconsistent.

### Low Defaults and Open Questions
- Legacy TDD metadata rewrite-on-read - Defaulted. Remove roadmap/plan TDD normalization that rewrites older metadata into canonical form on read, and require canonical shapes going forward.
- Migration-era local-state imports - Defaulted. Remove automatic import or upgrade behavior for historical session/memory shapes and keep only the current canonical stores.
- Diagnostic-lane end state - Deferred. The narrow inspect-only path may remain for this phase, but a later cleanup pass should decide when to remove that lane entirely.

### Agent's Discretion
- Exact unsupported-error copy when a still-supported parser hits a legacy key/shape, as long as it is explicit that the shape is unsupported and does not imply fallback support.
- Exact inspection/health wording for diagnostic-only legacy-shape reporting, as long as it stays clearly non-normalizing and non-supporting.
</decisions>

<specifics>
## Specific Ideas
- Lean on the existing greenfield support policy already captured in cleanup research and prior JJ/workspace-first phases.
- Preserve canonical `.planning/` artifact compatibility while deleting compatibility-only code that exists for obsolete installs, upgrades, or migration-era schemas.
- Treat hidden fallback behavior as product surface debt when it only exists for historical compatibility, not runtime resilience.
</specifics>

<stress_tested>
## Stress-Tested Decisions
- Unsupported surface behavior
  - Original decision: remove retired compatibility surfaces by default, with explicit unsupported errors only when a still-supported parser directly encounters a legacy shape.
  - Stress-test result: held. User accepted the breakage cost in favor of greenfield clarity and lower long-term drag.
- Canonical schema enforcement
  - Original decision: strict active paths with a narrow diagnostic inspect/health lane.
  - Stress-test result: revised only in sequencing, not direction. Keep the diagnostic lane intentionally narrow for Phase 174, and revisit removing it in a later cleanup phase rather than broadening support now.
- Discovery cleanup posture
  - Original decision: this was initially treated as a medium default leaning toward canonical-only surfaced guidance.
  - Stress-test revision: gut hidden/internal historical-compatibility fallbacks too; do not tolerate a split-brain product where stale behavior survives behind the scenes.
  - Follow-on clarification: this applies to compatibility-only fallback mappings, not resilience fallbacks that protect current supported runtime environments.
</stress_tested>

<deferred>
## Deferred Ideas
- Remove the remaining inspect/health diagnostic lane for unsupported legacy shapes in a later cleanup phase once it is no longer worth keeping.
</deferred>

---
*Phase: 174-greenfield-compatibility-surface-cleanup*
*Context gathered: 2026-03-31*
