# Phase 176: Command Hotspot Simplification & Hardening - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<phase_intent>
## Phase Intent
- **Local Purpose:** Break up highest-friction CLI hotspots into smaller, easier-to-reason-about subdomain files with less hidden state, and prove supported workflows still hold after cleanup.
- **Expected User Change:** Before: Maintainers had to work in multi-thousand-line bucket modules with ambient output globals and silent error swallowing. After: Maintainers work in smaller subdomains organized by CLI hotspot clusters, with fail-fast error handling and fully encapsulated shared state. Users see the same supported planning and settings workflows working after cleanup with regression proof.
- **Non-Goals:**
  - Rewriting the entire CLI from scratch
  - Changing supported command interfaces or user-facing behavior
  - Adding new capabilities beyond cleanup and hardening
</phase_intent>

<domain>
## Phase Boundary
Maintainers can change touched command families inside smaller subdomain files with guarded shared mutable state and fail-fast error handling, while supported planning and settings workflows continue working after cleanup with full integration test proof.
</domain>

<decisions>
## Implementation Decisions

### High-Impact Decisions
- **File split strategy** — **Locked.** Group by CLI hotspot clusters. Balance cohesion with isolation rather than fragmenting into one-file-per-family or leaving largest modules untouched.
- **Error handling contract** — **Locked.** Fail fast. Throw immediately on error in cleanup paths. Loud failures are easier to debug than silent error swallowing.

### Medium Decisions
- **Shared mutable state** — **Locked.** Full encapsulation. Wrap globals in module APIs and eliminate unguarded ambient state across cleanup paths.
- **Regression proof scope** — **Locked.** Full integration suite. Run all supported workflows end-to-end to prove canonical command routes still work after cleanup.

### Low Defaults and Open Questions
- **Subdomain file naming** — **Defaulted.** Follow existing `src/commands/` patterns for convention consistency.
- **Async/Control flow cleanup depth** — **Defaulted.** Preserve semantically meaningful async; remove only unnecessary indirection.

### Agent's Discretion
- Specific hotspot cluster boundaries and file layout within those clusters
- Which existing globals are candidates for encapsulation vs. removal
</decisions>

<specifics>
## Specific Ideas
No specific requirements — open to standard approaches. Existing codebase structure in `src/commands/` and related hotspot areas provides the reference baseline.
</specifics>

<stress_tested>
## Stress-Tested Decisions
All decisions held up under stress testing — no revisions needed.
</stress_tested>

<deferred>
## Deferred Ideas
None — discussion stayed within phase scope.
</deferred>

---
*Phase: 176-command-hotspot-simplification-hardening*
*Context gathered: 2026-03-31*
