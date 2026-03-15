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
### v12.1 — Tool Integration & Agent Enhancement

**DO-86:** Support ripgrep, fd, jq, yq, bat, gh with unified capability detection and graceful degradation
**DO-87:** Implement smarter agent routing based on task complexity and available agent capabilities
**DO-88:** Create better inter-agent collaboration patterns with shared context and handoff optimization
**DO-89:** Add decision functions for tool selection and multi-phase sequencing
**DO-90:** Improve agent context efficiency through intelligent capability-based filtering
</outcomes>

<criteria>
### v12.1 — Tool Integration & Agent Enhancement

**SC-66:** All major CLI tools (ripgrep, fd, jq, yq, bat, gh) detected and available in workflows
**SC-67:** Agent routing improved — 25%+ reduction in context overhead via capability-aware dispatch
**SC-68:** All inter-agent handoffs use shared context patterns — RACI audit validates improvements
**SC-69:** New decision functions for tool selection and phase sequencing with contract tests
**SC-70:** Tool absence gracefully handled — workflows complete with degradation or clear guidance
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
### v12.1 — 2026-03-15
- **Added** outcomes: DO-86 through DO-90 for tool integration, agent routing, collaboration
- **Added** criteria: SC-66 through SC-70 for v12.1 verification
  - Reason: Milestone v12.1 initiated

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
<!-- Highest outcome ID: DO-90 -->
