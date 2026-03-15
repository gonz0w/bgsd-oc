**Revision:** 22
**Created:** 2026-02-25
**Updated:** 2026-03-15

<objective>
A high-performance, data-driven agent orchestration engine that manages and delivers high-quality software with continuously reducing token usage and improving performance.
</objective>

<users>
- Software developers using AI coding assistants (OpenCode) for project planning and execution
- Solo developers managing complex multi-phase projects with AI assistance
- The GSD plugin's own development workflow (self-referential: planning GSD improvements using GSD)
</users>

<outcomes>
_No active outcomes — run `/bgsd-new-milestone` to define next milestone._
</outcomes>

<criteria>
_No active criteria — defined per milestone._
</criteria>

<constraints>
### Technical
- C-03: All operations are advisory — never block workflow execution
- C-08: Map fallback must still work on Node <22.5 — SQLite is an acceleration layer, not a hard dependency
- C-09: Markdown files remain human-readable and git-trackable — SQLite augments, doesn't hide data

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
### v12.0 — 2026-03-15
- **Archived** all v12.0 outcomes (DO-79 through DO-85) — all delivered
  - Reason: Milestone v12.0 complete — SQLite-first data layer shipped
- **Archived** all v12.0 criteria (SC-58 through SC-65) — all achieved
  - Reason: Milestone v12.0 complete

### v12.0 — 2026-03-14
- **Updated** objective: Shifted from internal quality/housekeeping to SQLite-first data layer architecture
- **Added** outcomes: DO-79 through DO-85 for structured tables, persistence, memory migration, enricher acceleration, decisions
- **Added** criteria: SC-58 through SC-65 for v12.0 verification

### v11.4 — 2026-03-13
- **Reset** objective: Shifted from LLM offloading to internal quality and planning debt cleanup
- **Archived** outcomes: DO-20 through DO-71 (44 outcomes delivered across v1.0-v11.3)
- **Archived** criteria: SC-01 through SC-50 (35 criteria from prior milestones)

(See `.planning/archive/INTENT-vv12.0.md` for full history)
</history>
<!-- Highest outcome ID: DO-85 -->
