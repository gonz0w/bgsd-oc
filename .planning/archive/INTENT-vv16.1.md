**Revision:** 27
**Created:** 2026-02-25
**Updated:** 2026-03-28

<objective>
A high-performance agent orchestration engine that delivers enterprise-quality software through a complete AI development team while maximizing LLM output per token by shifting administrative work to deterministic CLI operations.
</objective>

<outcomes>
### Active milestone outcomes (v16.1)

**DO-115:** Improve TDD reliability with deterministic selection, stronger execution gates, and end-to-end validation using `.planning/research/TDD-RELIABILITY-PRD.md`
**DO-116:** Speed up workflow execution with phase snapshots, batched state updates, fast discuss/verify modes, and fresh-context chained delivery using `.planning/research/WORKFLOW-ACCELERATION-PRD.md`

### Deferred candidate

**DO-117:** Explore dynamic model configuration and smarter profile management using `.planning/research/DYNAMIC-MODEL-CONFIG-PRD.md`
</outcomes>

<criteria>
### Active milestone success criteria (v16.1)

**SC-94:** TDD plans execute deterministically and prove RED/GREEN/REFACTOR behavior through fixture-backed end-to-end validation
**SC-95:** High-traffic workflows reduce coordination overhead through snapshotting, faster state updates, or reduced context churn without breaking contracts

### Deferred candidate criterion

**SC-96:** Model/profile configuration becomes easier to reason about and adjust without hard-coded workflow assumptions
</criteria>

<constraints>
### Technical
- C-03: All operations are advisory — never block workflow execution
- C-08: Map fallback must still work on Node <22.5 — SQLite is an acceleration layer, not a hard dependency
- C-09: Markdown files remain human-readable and git-trackable — SQLite augments, doesn't hide data
- C-10: Project-local agent improvements must stay inside `.planning/agents/` — never write to `~/.config`

### Business
- C-04: Backward compatible — projects without SQLite work exactly as before via Map fallback
- C-05: Analysis adds value without adding ceremony — no mandatory steps
</constraints>

<health>
### Quantitative
- HM-08: All tests pass with zero failures after each phase
- HM-09: Enricher completes in <50ms with warm SQLite cache
- HM-10: Zero redundant file reads per enrichment pass

### Qualitative
The data layer should be invisible to users — workflows feel faster, decisions are instant, and the human-readable markdown files stay accurate. SQLite is infrastructure, not ceremony.
</health>

<history>
### v16.0 — 2026-03-28
- Archived delivered enterprise developer team outcomes and success criteria to `.planning/archive/INTENT-vv16.0.md`
- Reset active intent to pending milestone seeds only
- Promoted TDD reliability, workflow acceleration, and dynamic model configuration to the next planning candidates

### v16.1 init — 2026-03-28
- Selected TDD reliability plus workflow acceleration as the active milestone scope
- Deferred dynamic model configuration to a later milestone candidate
</history>

<!-- Highest outcome ID: DO-117 -->
<!-- Highest criteria ID: SC-96 -->
